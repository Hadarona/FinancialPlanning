package com.hadarona.budget;
import org.junit.Test;
import static org.junit.Assert.*;
public class ServerAddressTest {
 @Test public void normalizesSecureOrigins(){assertEquals("https://budget.example",ServerAddress.normalize(" https://BUDGET.example:443/ "));assertEquals("https://budget.example:8443",ServerAddress.normalize("https://budget.example:8443"));}
 @Test public void rejectsUnsafeAddresses(){for(String input:new String[]{"http://budget.example","javascript:alert(1)","file:///data/","https://user:pass@budget.example","https://budget.example/path","https://budget.example?secret=1","https://budget.example#x","https://budget.example:99999","not a url"})assertNull(input,ServerAddress.normalize(input));}
 @Test public void onlyAllowsExactOriginNavigation(){assertTrue(ServerAddress.sameOrigin("https://budget.example","https://budget.example/budget?month=2026-10"));assertFalse(ServerAddress.sameOrigin("https://budget.example","https://budget.example.evil.test"));assertFalse(ServerAddress.sameOrigin("https://budget.example","https://budget.example:444"));assertFalse(ServerAddress.sameOrigin("https://budget.example","http://budget.example"));}
}
