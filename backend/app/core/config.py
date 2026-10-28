"""Typed configuration isolated from the legacy Django settings."""

from typing import Literal, Self

from pydantic import Field, SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="HDB_",
        env_file=None,
        extra="ignore",
        str_strip_whitespace=True,
        hide_input_in_errors=True,
    )

    app_name: str = Field(default="HDBoutique API", min_length=1)
    environment: Literal["development", "test", "production"] = "development"
    debug: bool = False
    business_api_enabled: bool = False
    database_host: str | None = Field(default=None, min_length=1)
    database_port: int = Field(default=5432, ge=1, le=65535)
    database_name: str | None = Field(default=None, min_length=1)
    database_user: str | None = Field(default=None, min_length=1)
    database_password: SecretStr | None = Field(default=None, min_length=1)

    @model_validator(mode="after")
    def validate_production_debug(self) -> Self:
        if self.environment == "production" and self.business_api_enabled:
            raise ValueError("Business API requires phase 8 permissions in production")
        if self.environment == "production" and self.debug:
            raise ValueError("Debug mode must be disabled in production")
        database_values = (
            self.database_host,
            self.database_name,
            self.database_user,
            self.database_password,
        )
        if any(value is not None for value in database_values) and not all(
            value is not None for value in database_values
        ):
            raise ValueError(
                "Database host, name, user and password are required together"
            )
        return self
