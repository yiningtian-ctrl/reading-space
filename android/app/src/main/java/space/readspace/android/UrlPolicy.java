package space.readspace.android;

import java.net.URI;

final class UrlPolicy {
    static final String ORIGIN = "https://reading-space-a42.pages.dev";
    static boolean trusted(String raw) {
        try {
            URI u = new URI(raw);
            return "https".equalsIgnoreCase(u.getScheme()) && "reading-space-a42.pages.dev".equalsIgnoreCase(u.getHost())
                && u.getRawUserInfo() == null && (u.getPort() == -1 || u.getPort() == 443);
        } catch (Exception e) { return false; }
    }
    static boolean external(String raw) {
        try {
            URI u = new URI(raw);
            return "https".equalsIgnoreCase(u.getScheme()) && u.getHost() != null && u.getRawUserInfo() == null;
        } catch (Exception e) { return false; }
    }
    static String filename(String name) {
        String safe = name == null ? "" : name.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "_");
        if (safe.trim().isEmpty() || safe.equals(".") || safe.equals("..")) return "readspace-backup.json";
        return safe.length() > 100 ? safe.substring(safe.length() - 100) : safe;
    }
}
