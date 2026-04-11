from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_db: str = "asm_db"
    postgres_user: str = "asm_user"
    postgres_password: str

    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    rabbitmq_host: str = "rabbitmq"
    rabbitmq_port: int = 5672
    rabbitmq_user: str = "asm"
    rabbitmq_password: str
    celery_broker_url: str

    reports_dir: str = "/data/reportes"
    consolidated_dir: str = "/data/consolidados"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
