from sdk_builder import MetorialSDKBuilder
from metorial_util_endpoint import MetorialEndpointManager
from mt_2025_01_01_pulsar.endpoints.sessions import MetorialSessionsEndpoint

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
    return {
        "sessions": MetorialSessionsEndpoint(manager),
        # Add other endpoints here
    }

def create_metorial_sdk():
    builder = MetorialSDKBuilder.create("myapi", "2025-01-01-pulsar") \
        .set_get_api_host(get_api_host) \
        .set_get_headers(get_headers)
    return builder.build(get_config)(get_endpoints)