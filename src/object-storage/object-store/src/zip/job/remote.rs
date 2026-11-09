//! Waiting for jobs that run on other instances. Every request here that waits for one job
//! shares one poller, which re-reads the record once per `wait_poll_interval` while anyone is
//! still waiting, so a crowd of waiters costs one record read per interval rather than one each.

use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard};

use tokio::sync::watch;

use super::{ZipJob, ZipJobManager};

#[derive(Debug, Clone)]
pub(crate) enum Polled {
    Job(Box<ZipJob>),
    /// The record could not be read; each waiter reads it itself to get the error.
    Failed,
}

#[derive(Default)]
pub(crate) struct RemotePolls {
    polls: Mutex<HashMap<String, Arc<watch::Sender<Polled>>>>,
}

impl RemotePolls {
    fn lock(&self) -> MutexGuard<'_, HashMap<String, Arc<watch::Sender<Polled>>>> {
        self.polls
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    /// Updates of `job`'s record, from the poller that is already running for it or a new one.
    pub fn watch(&self, manager: &Arc<ZipJobManager>, job: &ZipJob) -> watch::Receiver<Polled> {
        let mut polls = self.lock();
        if let Some(updates) = polls.get(&job.id) {
            return updates.subscribe();
        }

        let updates = Arc::new(watch::Sender::new(Polled::Job(Box::new(job.clone()))));
        let receiver = updates.subscribe();
        polls.insert(job.id.clone(), updates.clone());
        tokio::spawn(poll(manager.clone(), job.id.clone(), updates));
        receiver
    }

    /// Removes the poller unless a waiter subscribed meanwhile. Waiters only subscribe under
    /// the same lock, so none can be left on a poller that stopped.
    fn retire(&self, id: &str, updates: &Arc<watch::Sender<Polled>>, force: bool) -> bool {
        let mut polls = self.lock();
        if !force && updates.receiver_count() > 0 {
            return false;
        }
        if polls
            .get(id)
            .is_some_and(|current| Arc::ptr_eq(current, updates))
        {
            polls.remove(id);
        }
        true
    }
}

/// Re-reads the record with the dead-runner rule applied (see `ZipJobManager::load`) until the
/// job ends, the last waiter leaves or the instance shuts down.
async fn poll(manager: Arc<ZipJobManager>, id: String, updates: Arc<watch::Sender<Polled>>) {
    let interval = manager.settings.wait_poll_interval();

    loop {
        tokio::select! {
            _ = tokio::time::sleep(interval) => {}
            _ = updates.closed() => {}
            _ = manager.shutdown.cancelled() => {}
        }
        if manager
            .remote_polls
            .retire(&id, &updates, manager.shutdown.is_cancelled())
        {
            return;
        }

        let polled = match manager.load(&id).await {
            Ok(Some(stored)) => Polled::Job(Box::new(stored.job)),
            Ok(None) | Err(_) => Polled::Failed,
        };
        let ended = matches!(&polled, Polled::Job(job) if !job.is_active());
        updates.send_replace(polled);
        if ended {
            manager.remote_polls.retire(&id, &updates, true);
            return;
        }
    }
}
