export let isOutgoingEmailComplete = (email: {
  numberOfDestinations: number;
  numberOfDestinationsCompleted: number;
}) => email.numberOfDestinationsCompleted >= email.numberOfDestinations;
