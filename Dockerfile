#FROM node:12.9-buster
FROM node:8.15.1

COPY . /app
WORKDIR /app
ENV NODE_PATH=/opt/node_modules

RUN npm --registry http://registry.npmmirror.com install pomelo@2.2.7 -g
RUN npm --registry http://registry.npmmirror.com install -d
RUN mv /app/node_modules /opt/node_modules
RUN curl -fsSL https://code-server.dev/install.sh | sh
RUN mkdir -p /root/.config/code-server \
    && chmod +x /app/start.sh

#CMD ["pomelo", "start"]
CMD ["/app/start.sh"]