FROM nvidia/cuda:12.8.1-cudnn-devel-ubuntu20.04
# FROM nvidia/cuda:11.8.0-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies for cuda
RUN apt update -y && \
    apt install -y \
    libgl1 \
    build-essential \
    cython3
    
RUN apt update -y && \
    apt install -y \
    python3.9 \
    python3.9-dev \
    python3.9-distutils \
    python3.9-venv \
    python3-pip && \ 
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
    
RUN ln -sf python3.9 /usr/bin/python && \
    ln -sf pip3 /usr/bin/pip

# 3. Install python dependencies
RUN python -m pip install --upgrade pip setuptools wheel cython
COPY ./requirements.txt /requirements.txt
RUN python -m pip install --upgrade pip && python -m pip install --no-cache-dir --ignore-installed -r /requirements.txt

# Copy workspace
COPY app/ /app/
WORKDIR /app/

# Copy init script
COPY init.sh /usr/local/bin/init.sh
RUN chmod +x /usr/local/bin/init.sh

# Expose port
EXPOSE 8889

RUN echo Build finished...
# Run init script
CMD ["/bin/bash","/usr/local/bin/init.sh"]
