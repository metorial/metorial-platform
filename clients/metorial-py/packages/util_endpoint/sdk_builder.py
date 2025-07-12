from typing import Callable, Any, Dict, Optional, TypeVar, Generic
from .metorial_util_endpoint import MetorialEndpointManager

ConfigT = TypeVar("ConfigT")
ApiVersionT = TypeVar("ApiVersionT")


class MetorialSDKBuilder(Generic[ApiVersionT, ConfigT]):
  def __init__(self, api_name: str, api_version: ApiVersionT):
    self.api_name = api_name
    self.api_version = api_version
    self._get_api_host: Optional[Callable[[ConfigT], str]] = None
    self._get_headers: Optional[Callable[[ConfigT], Dict[str, str]]] = None

  @classmethod
  def create(cls, api_name: str, api_version: ApiVersionT):
    return cls(api_name, api_version)

  def set_get_api_host(self, get_api_host: Callable[[ConfigT], str]):
    self._get_api_host = get_api_host
    return self

  def set_get_headers(self, get_headers: Callable[[ConfigT], Dict[str, str]]):
    self._get_headers = get_headers
    return self

  def build(self, get_config: Callable[[Dict[str, Any]], ConfigT]):
    if not self._get_headers:
      raise ValueError("get_headers must be set")
    if not self._get_api_host:
      raise ValueError("api_host must be set")

    def builder(get_endpoints: Callable[[MetorialEndpointManager], Dict[str, Any]]):
      def sdk(config: Dict[str, Any]):
        full_config = get_config(config)
        api_host = self._get_api_host(full_config)
        manager = MetorialEndpointManager(
          full_config,
          api_host,
          self._get_headers,
          enable_debug_logging=bool(config.get("enableDebugLogging", False)),
        )
        endpoints = get_endpoints(manager)
        return {"_config": {"apiHost": api_host, **full_config}, **endpoints}

      return sdk

    return builder
