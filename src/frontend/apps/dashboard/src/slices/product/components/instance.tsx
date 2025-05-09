import { storedAtom, useAtom } from '@metorial/data-hooks';
import { useCurrentProject } from '@metorial/state';
import { Select } from '@metorial/ui';
import { useEffect, useRef } from 'react';

let selectedInstance = storedAtom<Record<string, string>>('selected_instance', {});

export let useSelectedInstance = () => {
  let allInstances = useAtom(selectedInstance);
  let project = useCurrentProject();
  let instanceId = allInstances[project.data?.id ?? ''];

  return {
    ...project,
    data: project.data?.instances.find(i => i.id === instanceId) ?? project.data?.instances[0]
  };
};

export let InstanceSelector = () => {
  let allInstances = useAtom(selectedInstance);
  let project = useCurrentProject();

  let instance = allInstances[project.data?.id ?? ''];
  let setInstance = (i: string) => {
    allInstances[project.data?.id ?? ''] = i;
    selectedInstance.set({ ...allInstances });
  };

  let instanceSetRef = useRef(false);
  useEffect(() => {
    if (instanceSetRef.current) return;

    if (project.data?.instances.length) {
      setInstance(project.data?.instances[0].id);
      instanceSetRef.current = true;
    }
  }, [project.data?.instances]);

  return (
    <Select
      label="Instance"
      hideLabel
      value={instance}
      onChange={setInstance}
      items={
        project.data?.instances.map(i => ({
          id: i.id,
          label: i.name
        })) ?? []
      }
    />
  );
};
