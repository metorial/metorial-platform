import pytest
from unittest.mock import patch, MagicMock
from metorial_util_endpoint import BaseMetorialEndpoint, MetorialRequest, MetorialSDKError

class _TestEndpoint(BaseMetorialEndpoint):
    def get(self, request: MetorialRequest):
        return self._get(request)
    def post(self, request: MetorialRequest):
        return self._post(request)
    def put(self, request: MetorialRequest):
        return self._put(request)
    def delete(self, request: MetorialRequest):
        return self._delete(request)

@pytest.fixture
def mock_manager():
    class DummyManager:
        def _get(self, request): return DummyTransform()
        def _post(self, request): return DummyTransform()
        def _put(self, request): return DummyTransform()
        def _delete(self, request): return DummyTransform()
    class DummyTransform:
        def transform(self, mapper): return mapper['transformFrom']({'data': 'test'})
    return DummyManager()

def test_get_request(monkeypatch, mock_manager):
    endpoint = _TestEndpoint(mock_manager)
    request = MetorialRequest('/test')
    result = endpoint.get(request).transform({'transformFrom': lambda data: data})
    assert result == {'data': 'test'}

def test_post_request(monkeypatch, mock_manager):
    endpoint = _TestEndpoint(mock_manager)
    request = MetorialRequest('/test', body={'key': 'value'})
    result = endpoint.post(request).transform({'transformFrom': lambda data: data})
    assert result == {'data': 'test'}

def test_network_error(monkeypatch):
    class DummyManager:
        def _get(self, request):
            raise MetorialSDKError({'status': 0, 'code': 'network_error', 'message': 'Network error'})
    endpoint = _TestEndpoint(DummyManager())
    request = MetorialRequest('/test')
    with pytest.raises(MetorialSDKError):
        endpoint.get(request).transform({'transformFrom': lambda data: data})

def test_malformed_json(monkeypatch):
    class DummyManager:
        def _get(self, request):
            raise MetorialSDKError({'status': 500, 'code': 'malformed_response', 'message': 'Malformed JSON'})
    endpoint = _TestEndpoint(DummyManager())
    request = MetorialRequest('/test')
    with pytest.raises(MetorialSDKError):
        endpoint.get(request).transform({'transformFrom': lambda data: data})

def test_non_ok_response(monkeypatch):
    class DummyManager:
        def _get(self, request):
            raise MetorialSDKError({'status': 400, 'code': 'bad_request', 'message': 'Bad request'})
    endpoint = _TestEndpoint(DummyManager())
    request = MetorialRequest('/test')
    with pytest.raises(MetorialSDKError):
        endpoint.get(request).transform({'transformFrom': lambda data: data})
