from sdk_builder import MetorialSDKBuilder
from metorial_util_endpoint import MetorialEndpointManager

from mt_2025_01_01_pulsar.endpoints.instances import MetorialInstanceEndpoint
from mt_2025_01_01_pulsar.endpoints.secrets import MetorialSecretsEndpoint

from mt_2025_01_01_pulsar.endpoints.servers import (
    MetorialServersEndpoint,
    MetorialServersVariantsEndpoint,
    MetorialServersVersionsEndpoint,
    MetorialServersDeploymentsEndpoint,
    MetorialServersImplementationsEndpoint,
    MetorialServersCapabilitiesEndpoint,
)
from mt_2025_01_01_pulsar.endpoints.server_runs import (
    MetorialServerRunsEndpoint,
    MetorialServerRunErrorsEndpoint,
)
from mt_2025_01_01_pulsar.endpoints.sessions import (
    MetorialSessionsEndpoint,
    MetorialSessionsEventsEndpoint,
    MetorialSessionsMessagesEndpoint,
    MetorialSessionsServerSessionsEndpoint,
)


def get_config(soft):
    return {
        **soft,
        "apiVersion": soft.get("apiVersion", "2025-01-01-pulsar"),
    }


def get_headers(config):
    return {"Authorization": f"Bearer {config['apiKey']}"}


def get_api_host(config):
    return config.get("apiHost", "https://api.metorial.com")


def get_endpoints(manager: MetorialEndpointManager):
    # root endpoints
    endpoints = {
        "instance": MetorialInstanceEndpoint(manager),
        "secrets": MetorialSecretsEndpoint(manager),
    }

    servers = MetorialServersEndpoint(manager)

    setattr(servers, "variants", MetorialServersVariantsEndpoint(manager))
    setattr(servers, "versions", MetorialServersVersionsEndpoint(manager))
    setattr(servers, "deployments", MetorialServersDeploymentsEndpoint(manager))
    setattr(servers, "implementations", MetorialServersImplementationsEndpoint(manager))
    setattr(servers, "capabilities", MetorialServersCapabilitiesEndpoint(manager))

    runs = MetorialServerRunsEndpoint(manager)
    setattr(runs, "errors", MetorialServerRunErrorsEndpoint(manager))
    setattr(servers, "runs", runs)

    endpoints["servers"] = servers

    sessions = MetorialSessionsEndpoint(manager)
    setattr(sessions, "events", MetorialSessionsEventsEndpoint(manager))
    setattr(sessions, "messages", MetorialSessionsMessagesEndpoint(manager))
    setattr(sessions, "serverSessions", MetorialSessionsServerSessionsEndpoint(manager))
    endpoints["sessions"] = sessions

    return endpoints


def create_metorial_sdk():
    builder = (
        MetorialSDKBuilder.create("myapi", "2025-01-01-pulsar")
        .set_get_api_host(get_api_host)
        .set_get_headers(get_headers)
    )
    return builder.build(get_config)(get_endpoints)
