FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PYTHONPATH=/app

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 10001 app

COPY requirements.txt .
RUN python -m pip install --no-cache-dir \
    --index-url https://download.pytorch.org/whl/cpu \
    --extra-index-url https://pypi.org/simple \
    "torch==2.15.0+cpu"
RUN python -m pip install --no-cache-dir -r requirements.txt

COPY main.py auth_security.py users.py ui_api.py dashboard.html ./
COPY rag/ ./rag/
COPY identityshield_mcp/ ./identityshield_mcp/
COPY data/ ./data/
COPY models/ ./models/
COPY knowledge/security_playbooks/ ./knowledge/security_playbooks/
COPY reports/threshold_selection/selected_configuration.json ./reports/threshold_selection/
COPY reports/threshold_selection/logisticregression_thresholds_validation.csv ./reports/threshold_selection/
COPY reports/final_evaluation/final_test_metrics.json ./reports/final_evaluation/
COPY scripts/docker_entrypoint.py ./scripts/docker_entrypoint.py

RUN mkdir -p /app/storage /home/app/.cache/huggingface \
    && chown -R app:app /app /home/app/.cache

USER app

EXPOSE 8000

CMD ["python", "scripts/docker_entrypoint.py"]
