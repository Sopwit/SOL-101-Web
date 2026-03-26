export function resolveAssetUrl(url?: string | null) {
  if (!url) {
    return '';
  }

  if (/^(?:[a-z]+:)?\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }

  const baseUrl = import.meta.env.BASE_URL || '/';
  const normalizedPath = url.replace(/^\.?\//, '');
  const looksLikeStaticAsset =
    normalizedPath.startsWith('assets/') ||
    normalizedPath.startsWith('shop-items/') ||
    /\.(?:png|jpe?g|webp|gif|svg|avif)$/i.test(normalizedPath);

  if (url.startsWith('/')) {
    // API responses can already be normalized once. Keep the resolver idempotent
    // so GitHub Pages base paths are not duplicated on repeated calls.
    if (baseUrl !== '/' && url === baseUrl.slice(0, -1)) {
      return `${baseUrl}`;
    }

    if (baseUrl !== '/' && url.startsWith(baseUrl)) {
      return url;
    }

    return `${baseUrl}${url.slice(1)}`;
  }

  if (looksLikeStaticAsset) {
    return `${baseUrl}${normalizedPath}`;
  }

  return url;
}
