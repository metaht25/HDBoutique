"""Typed configuration isolated from the legacy Django settings."""

from typing import Literal, Self

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="HDB_",
        env_file=None,
        extra="ignore",
        str_strip_whitespace=True,
    )

    app_name: str = Field(default="HDBoutique API", min_length=1)
    environment: Literal["development", "test", "production"] = "development"
    debug: bool = False

    @model_validator(mode="after")
    def validate_production_debug(self) -> Self:
        if self.environment == "production" and self.debug:
            raise ValueError("Debug mode must be disabled in production")
        return self
