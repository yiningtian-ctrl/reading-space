package space.readspace.android;

import org.junit.Test;
import static org.junit.Assert.*;

public class UrlPolicyTest {
    @Test public void onlyProductionHttpsStaysInsideApp() {
        assertTrue(UrlPolicy.trusted(UrlPolicy.ORIGIN + "/#profile"));
        assertTrue(UrlPolicy.trusted(UrlPolicy.ORIGIN + ":443/#library"));
        for (String url : new String[]{"http://reading-space-a42.pages.dev", "https://reading-space-a42.pages.dev.evil.test", "https://evil.test@reading-space-a42.pages.dev", "https://reading-space-a42.pages.dev:444", "javascript:alert(1)", "file:///secret", "content://secret", "intent://app", "https://reading-space-a42.pages.dev\\@evil.test"}) assertFalse(url, UrlPolicy.trusted(url));
    }
    @Test public void externalLinksNeverBecomeArbitraryIntents() {
        assertTrue(UrlPolicy.external("https://www.britishcouncil.org/"));
        for (String url : new String[]{"intent://x", "file:///sdcard/file", "content://x", "http://example.org", "javascript:void(0)", "https://user@example.org"}) assertFalse(url, UrlPolicy.external(url));
    }
    @Test public void exportedNamesCannotContainPathsOrControlCharacters() {
        assertEquals("readspace-vocabulary.csv", UrlPolicy.filename("readspace-vocabulary.csv"));
        assertEquals(".._.._notes.json", UrlPolicy.filename("../../notes.json"));
        assertEquals("readspace-backup.json", UrlPolicy.filename(""));
        assertFalse(UrlPolicy.filename("a\nb.json").contains("\n"));
    }
}
