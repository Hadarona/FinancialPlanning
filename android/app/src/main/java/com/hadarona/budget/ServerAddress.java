package com.hadarona.budget;
import java.net.URI;
import java.util.Locale;

/** Canonical HTTPS origin. No secrets or credentials are stored in the URL. */
public final class ServerAddress {
    private ServerAddress() {}
    public static String normalize(String input) {
        try {
            URI uri = new URI(input.trim());
            if (!"https".equalsIgnoreCase(uri.getScheme()) || uri.getHost() == null || uri.getUserInfo() != null
                || uri.getRawQuery() != null || uri.getRawFragment() != null || uri.getPort() > 65535
                || !(uri.getPath().isEmpty() || "/".equals(uri.getPath()))) return null;
            return new URI("https", null, uri.getHost().toLowerCase(Locale.ROOT), uri.getPort() == 443 ? -1 : uri.getPort(), null, null, null).toString();
        } catch (Exception error) { return null; }
    }
    public static boolean sameOrigin(String origin, String destination) {
        try {
            URI uri = new URI(destination);
            String other = normalize(new URI(uri.getScheme(), uri.getUserInfo(), uri.getHost(), uri.getPort(), null, null, null).toString());
            return origin != null && origin.equals(other);
        } catch (Exception error) { return false; }
    }
}
