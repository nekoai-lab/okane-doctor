# Cloud Run 用のイメージ（asia-northeast1）
#
# 算定エンジンは params/*.yaml を実行時に readFileSync で読む（src/params/index.ts）。
# **イメージに params を入れ忘れると、本番だけ「パラメータが見つかりません」で落ちる。**
# Next の standalone 出力に任せず、明示的に COPY する（壊れ方が静かなので、二重に担保する）。

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts：prepare が git のフックパスを設定するだけで、コンテナには git が無い
RUN npm ci --ignore-scripts
COPY . .
# 共有画像の絶対 URL の基点（app/layout.tsx の metadataBase）。ビルドのときに読まれる。
# 値は Cloud Build のトリガーの置換変数 _SITE_URL から渡す（公開リポジトリに本番 URL を書かない）
ARG SITE_URL=
ENV SITE_URL=${SITE_URL}
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Cloud Run は PORT を渡してくる。standalone の server.js はこれを読む
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
# 動的なページ（/・/result など）は実行時に metadataBase を組み立てるので、実行側にも渡す
ARG SITE_URL=
ENV SITE_URL=${SITE_URL}

# root で動かさない
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# standalone 出力は public/ を含まない。入れ忘れると、LP の家族画像（public/lp/）が
# 本番だけ 404 になり、代わりに alt の文字が出る（2026-10-15 に実際に起きた）
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/params ./params

USER nextjs
EXPOSE 8080
CMD ["node", "server.js"]
