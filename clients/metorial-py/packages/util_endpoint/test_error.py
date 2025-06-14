from .error import MetorialSDKError

def response():
    return {
        'status': 400,
        'code': 'INVALID_REQUEST',
        'message': 'The request is invalid.',
        'hint': 'Check the request parameters.',
        'description': 'The request parameters are incorrect.',
        'entity': 'User',
        'reason': 'Invalid parameters',
        'errors': [
            {
                'code': 'REQUIRED_FIELD',
                'message': 'The field is required.',
                'path': ['username']
            }
        ]
    }

def test_metorial_sdk_error_instance():
    error = MetorialSDKError(response())
    assert isinstance(error, MetorialSDKError)
    assert str(error) == '[METORIAL ERROR]: INVALID_REQUEST - The request is invalid.'

def test_code():
    error = MetorialSDKError(response())
    assert error.code == 'INVALID_REQUEST'

def test_message():
    error = MetorialSDKError(response())
    assert error.message == 'The request is invalid.'

def test_hint():
    error = MetorialSDKError(response())
    assert error.hint == 'Check the request parameters.'

def test_description():
    error = MetorialSDKError(response())
    assert error.description == 'The request parameters are incorrect.'

def test_reason():
    error = MetorialSDKError(response())
    assert error.reason == 'Invalid parameters'

def test_validation_errors():
    error = MetorialSDKError(response())
    assert error.validation_errors == [
        {
            'code': 'REQUIRED_FIELD',
            'message': 'The field is required.',
            'path': ['username']
        }
    ]

def test_entity():
    error = MetorialSDKError(response())
    assert error.entity == 'User'
