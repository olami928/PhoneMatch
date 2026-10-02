# Model service container (M7 deployment).
#
# WHY THE MODEL IS TRAINED INSIDE THIS IMAGE: `ml_model.joblib` is 41 MB and is
# deliberately git-ignored (.gitignore), because it is regeneratable and would
# bloat every clone. That means a fresh deploy from git has NO model file, and
# `ml_recommender.py` loads it at import time — so without this Dockerfile the
# service crashes on startup with FileNotFoundError and every shopper sees
# "our recommendation model is not available".
#
# The fix is to build the artifact at image build time. It only takes ~16s and
# needs no network: train_model.py reads the COMMITTED training_data.csv.
# That keeps the repo small and makes a deploy self-contained and reproducible.
#
# D35 (hard constraint): this MUST be a long-lived container. A serverless
# function cannot hold the warm 41 MB model in memory.

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Dependencies first, so a code change does not reinstall them. This combines the
# training libraries (pandas/numpy/scikit-learn/joblib — needed to BUILD the
# model) with the serving libraries (fastapi/uvicorn).
COPY model/legacy/requirements.txt /tmp/legacy-req.txt
COPY model/service/requirements.txt /tmp/service-req.txt
RUN pip install --no-cache-dir -r /tmp/legacy-req.txt -r /tmp/service-req.txt

# The code. model/ is copied whole because the recommender imports from
# model/src/ and model/legacy/src/, and reads model/config/ and model/data/.
COPY model/ /app/model/

# --- build the model artifact the git-ignored repo cannot carry ------------
# Fails the build loudly if training fails, rather than shipping an image whose
# service would crash on the first request.
RUN python /app/model/legacy/src/train_model.py \
    && ls -lh /app/model/legacy/src/ml_model.joblib

EXPOSE 8000

# Model startup includes the 41 MB load, so the container needs a real grace
# period before uvicorn answers. Without this, a slow cold start gets killed.
CMD ["sh", "-c", "uvicorn main:app --app-dir /app/model/service --host 0.0.0.0 --port ${PORT:-8000}"]