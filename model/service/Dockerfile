# Model service container (M7 deployment).
#
# WHY THE MODEL IS TRAINED INSIDE THIS IMAGE: `ml_model.joblib` is git-ignored
# (.gitignore) because it is regeneratable and would bloat every clone. A service
# built from a plain clone therefore has NO model file, and ml_recommender.py
# loads it at import time, so without a build step the service dies on startup
# with FileNotFoundError and every shopper sees "our recommendation model is not
# available".
#
# Training runs here (~27s, no network: train_model.py reads the COMMITTED
# training_data.csv), which keeps the repo small and the deploy reproducible. It
# saves compressed, which is what makes the service fast enough to host: the
# artifact is 13.5 MB and loads in 0.93s, versus 41 MB and 18.4s uncompressed.
# Compression is lossless and the top-3 recommendations are identical either way.
#
# D35 still applies in spirit: this is a long-lived container, not a serverless
# function. The 13.5 MB artifact now fits comfortably in a serverless bundle too,
# but keeping the model warm in memory is still the faster, more reliable design.
#
# If you ever change the training data or the forest, this build retrains, so the
# deployed model can never drift from the committed data.

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

# --workers 1 on purpose: uvicorn would otherwise fork several processes that each
# load their own 13.5 MB copy of the model, wasting memory for no speed gain. The
# model is fast enough that one worker serves the shop comfortably.
CMD ["sh", "-c", "uvicorn main:app --app-dir /app/model/service --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]