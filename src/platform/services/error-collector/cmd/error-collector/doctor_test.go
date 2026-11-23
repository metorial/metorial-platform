package main

import "testing"

func TestDoctorReleaseVersion(t *testing.T) {
	releaseVersion := "2026.11.23"
	t.Setenv("METORIAL_RELEASE_VERSION", releaseVersion)

	c := &collector{status: &status{}}
	d, err := c.doctor()
	if err != nil {
		t.Fatal(err)
	}

	report, err := d.Run(t.Context(), false)
	if err != nil {
		t.Fatal(err)
	}

	if report.ReleaseVersion == nil || *report.ReleaseVersion != releaseVersion {
		t.Error("Doctor did not report METORIAL_RELEASE_VERSION as the release version")
	}
	if report.BuildVersion == nil || *report.BuildVersion != version {
		t.Error("Doctor did not report the binary version as the build version")
	}
}
