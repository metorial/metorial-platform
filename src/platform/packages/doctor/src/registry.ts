import type { CheckDefinition, Doctor } from '@lowerdeck/doctor';

let registeredChecks: CheckDefinition[] = [];
let fingerprints: Record<string, string> = {};
let doctors = new Set<Doctor>();

// On-prem entrypoints register their checks before importing the shared server, but a check
// registered after the health server started still reaches it.
export let registerDoctorChecks = (...checks: CheckDefinition[]) => {
  registeredChecks.push(...checks);
  for (let doctor of doctors) doctor.register(...checks);
};

export let registerDoctorFingerprint = (name: string, value: string) => {
  fingerprints[name] = value;
};

export let doctorFingerprints = () => fingerprints;

export let attachDoctor = (doctor: Doctor) => {
  doctors.add(doctor);
  doctor.register(...registeredChecks);
};

export let resetDoctorRegistry = () => {
  registeredChecks = [];
  doctors.clear();
  for (let key of Object.keys(fingerprints)) delete fingerprints[key];
};
