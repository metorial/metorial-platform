from typing import Any, Dict, Optional, Union
from urllib.parse import urljoin


class MetorialSDKError(Exception):
  def __init__(self, data: Dict[str, Any]):
    self.status = data.get("status", 0)
    self.code = data.get("code", "unknown_error")
    self.message = data.get("message", "Unknown error")
    super().__init__(f"[{self.code}] {self.message}")


class MetorialRequest:
  def __init__(
    self,
    path: Union[str, list[str]],
    host: Optional[str] = None,
    query: Optional[Dict[str, Any]] = None,
    body: Optional[Dict[str, Any]] = None,
  ):
    self.path = path
    self.host = host
    self.query = query
    self.body = body


class MetorialEndpointManager:
  def __init__(
    self,
    config: Any,
    api_host: str,
    get_headers,
    enable_debug_logging: bool = False,
  ):
    self.config = config
    self.api_host = api_host
    self.get_headers = get_headers
    self.enable_debug_logging = enable_debug_logging

  def _request(
    self, method: str, request: MetorialRequest, try_count: int = 0
  ) -> Any:
    path = (
      "/".join(request.path) if isinstance(request.path, list) else request.path
    )
    base_url = request.host or self.api_host
    url = urljoin(base_url, path)
    params = request.query or {}
    headers = self.get_headers(self.config) or {}
    has_body = method in ("POST", "PUT", "PATCH")
    data = None
    json = None
    files = None
    if has_body and request.body:
      if hasattr(request.body, "read"):
        files = request.body
      else:
        json = request.body
    if self.enable_debug_logging:
      print(
        f"[Metorial] {method} {url}",
        {"body": request.body, "query": request.query},
      )
    try:
      import requests

      resp = requests.request(
        method,
        url,
        params=params,
        headers=headers,
        json=json,
        files=files,
        allow_redirects=True,
        timeout=30,
      )
      if resp.status_code == 429 and try_count < 3:
        retry_after = resp.headers.get("Retry-After")
        if retry_after:
          import time

          time.sleep(int(retry_after) + 3)
          return self._request(method, request, try_count + 1)
    except Exception as error:
      if self.enable_debug_logging:
        print(f"[Metorial] {method} {url}", error)
      raise MetorialSDKError(
        {
          "status": 0,
          "code": "network_error",
          "message": "Unable to connect to Metorial API - please check your internet connection",
        }
      )
    try:
      data = resp.json()
    except Exception as error:
      if self.enable_debug_logging:
        print(f"[Metorial] {method} {url}", error)
      raise MetorialSDKError(
        {
          "status": resp.status_code,
          "code": "malformed_response",
          "message": "The Metorial API returned an unexpected response. Expected JSON.",
        }
      )
    if not resp.ok:
      if self.enable_debug_logging:
        print(f"[Metorial] {method} {url}", data)
      raise MetorialSDKError(data)
    if self.enable_debug_logging:
      print(f"[Metorial] {method} {url}", data)
    return data

  def _request_and_transform(self, method: str, request: MetorialRequest):
    class Transformer:
      def transform(self_inner, mapper):
        data = self._request(method, request)
        return (
          mapper.transformFrom(data)
          if hasattr(mapper, "transformFrom")
          else mapper(data)
        )

    return Transformer()

  def _get(self, request: MetorialRequest):
    return self._request_and_transform("GET", request)

  def _post(self, request: MetorialRequest):
    return self._request_and_transform("POST", request)

  def _put(self, request: MetorialRequest):
    return self._request_and_transform("PUT", request)

  def _patch(self, request: MetorialRequest):
    return self._request_and_transform("PATCH", request)

  def _delete(self, request: MetorialRequest):
    return self._request_and_transform("DELETE", request)


class BaseMetorialEndpoint:
  def __init__(self, manager: MetorialEndpointManager):
    self.manager = manager

  def _get(self, request: MetorialRequest):
    return self.manager._get(request)

  def _post(self, request: MetorialRequest):
    return self.manager._post(request)

  def _put(self, request: MetorialRequest):
    return self.manager._put(request)

  def _patch(self, request: MetorialRequest):
    return self.manager._patch(request)

  def _delete(self, request: MetorialRequest):
    return self.manager._delete(request)
