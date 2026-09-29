package com.enterprise.itmapping.feature.graphsnapshot.application;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Locale;
import java.util.Set;
import java.util.function.Predicate;
import org.junit.jupiter.api.Test;

class ShareCopyNamesTest {

  @Test
  void keepsTheNameWhenTheRecipientRootIsFree() {
    assertEquals("Payments", ShareCopyNames.choose("Payments", "alice", taken()));
  }

  @Test
  void addsTheSenderWhenTheNameIsTaken() {
    assertEquals(
        "Payments (from alice)",
        ShareCopyNames.choose("Payments", "alice", taken("payments")));
  }

  @Test
  void numbersTheCopyWhenTheSenderSuffixIsTaken() {
    assertEquals(
        "Payments (from alice) 2",
        ShareCopyNames.choose("Payments", "alice", taken("payments", "payments (from alice)")));
  }

  @Test
  void shortensALongNameSoTheCopyStaysWithin80Characters() {
    String original = "P".repeat(80);
    String copy = ShareCopyNames.choose(original, "alice", taken(original.toLowerCase(Locale.ROOT)));

    assertEquals(80, copy.length());
    assertTrue(copy.endsWith(" (from alice)"));
  }

  private static Predicate<String> taken(String... names) {
    Set<String> taken = Set.of(names);
    return (name) -> taken.contains(name.toLowerCase(Locale.ROOT));
  }
}
