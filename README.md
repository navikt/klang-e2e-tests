# Klang E2E tests

This app uses [Playwright](https://playwright.dev/) to test that the app behaves as expected.

## Running locally

### Against `dev`

`bun dev` or `bun dev --headed`

Will run the tests against [klage.intern.dev.nav.no](https://klage.intern.dev.nav.no) with the local config.

### Against `localhost:8064`

`bun local` or `bun local --headed`

Will run the tests against [localhost:8064](http://localhost:8064) with local config.

### Just like in NAIS

`bun test` or `bun test --headed`

Will run the tests against [klage.intern.dev.nav.no](https://klage.intern.dev.nav.no) with the same config as in NAIS.

## GCP

```
kubectl create configmap slack-e2e-configmap \
--from-literal=klage_notifications_channel=klage-notifications

kubectl create secret generic slack-e2e-secrets \
--from-literal=slack_e2e_token=<token> \
--from-literal=slack_signing_secret=<secret>
```

As a one-time job, before the tests can run, we must apply the network policy:

```
kubectl apply -f nais/e2e-network-policy.yaml -n klage
```
