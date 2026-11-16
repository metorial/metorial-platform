// The webhook system is sophisticated enough where we really don't need
// these limits, that's why I set them so high.
export let MAX_ACTIVE_LISTENERS_PER_DESTINATION = 15_000;
export let MAX_ACTIVE_LISTENERS_PER_ORGANIZATION = 500_000;
