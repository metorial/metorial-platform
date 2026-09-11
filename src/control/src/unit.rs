use std::collections::BTreeMap;

use miette::{Result, WrapErr};

use crate::{process, root::ProjectRoot, turbo};

pub async fn run(project: &ProjectRoot, filters: &[String]) -> Result<()> {
    let args = command_args(filters);
    let (program, args) = turbo::command(&project.root, args);
    process::run(&program, &args, &project.root, &BTreeMap::new())
        .await
        .wrap_err("unit tests failed")
}

fn command_args(filters: &[String]) -> Vec<String> {
    turbo::run_args("test", filters, Some(1))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_unfiltered_unit_test_command() {
        assert_eq!(
            command_args(&[]),
            [
                "run".to_string(),
                "test".to_string(),
                "--ui=stream".to_string(),
                "--concurrency=1".to_string(),
            ]
        );
    }

    #[test]
    fn forwards_turbo_filters_without_rewriting() {
        assert_eq!(
            command_args(&[
                "@lowerdeck/hash".into(),
                "!@metorial/shuttle".into(),
                "@metorial/api...".into(),
                "[HEAD^]".into(),
            ]),
            [
                "run".to_string(),
                "test".to_string(),
                "--ui=stream".to_string(),
                "--concurrency=1".to_string(),
                "--filter".to_string(),
                "@lowerdeck/hash".to_string(),
                "--filter".to_string(),
                "!@metorial/shuttle".to_string(),
                "--filter".to_string(),
                "@metorial/api...".to_string(),
                "--filter".to_string(),
                "[HEAD^]".to_string(),
            ]
        );
    }
}
