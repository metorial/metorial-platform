class MetorialError(Exception):
  """
  Base error for Metorial SDK. Use MetorialError.is_metorial_error(error) to check.
  """

  __typename = "metorial.error"
  __is_metorial_error = True

  def __init__(self, message: str):
    Exception.__init__(self, f"[METORIAL ERROR]: {message}")
    self._message = message

  @property
  def message(self):
    return self._message

  @staticmethod
  def is_metorial_error(error: Exception) -> bool:
    return getattr(error, "__is_metorial_error", False)


class MetorialSDKError(MetorialError):
  __typename = "metorial.sdk.error"

  def __init__(self, response: dict):
    self.response = response
    code = response.get("code", "unknown_error")
    message = response.get("message", "Unknown error")
    super().__init__(f"{code} - {message}")

  @property
  def code(self):
    return self.response.get("code")

  @property
  def message(self):
    return self.response.get("message")

  @property
  def hint(self):
    return self.response.get("hint")

  @property
  def description(self):
    return self.response.get("description")

  @property
  def reason(self):
    return self.response.get("reason")

  @property
  def validation_errors(self):
    return self.response.get("errors")

  @property
  def entity(self):
    return self.response.get("entity")


def is_metorial_sdk_error(error: Exception) -> bool:
  return getattr(error, "__typename", None) == "metorial.sdk.error"
