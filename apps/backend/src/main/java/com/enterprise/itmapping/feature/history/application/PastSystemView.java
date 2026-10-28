package com.enterprise.itmapping.feature.history.application;

import com.enterprise.itmapping.feature.history.infrastructure.persistence.SystemGraphState;
import java.time.Clock;
import java.time.LocalDate;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionStatus;
import org.springframework.transaction.support.DefaultTransactionDefinition;
import org.springframework.web.server.ResponseStatusException;

/**
 * Runs unchanged read code against the graph of a past day. The day is written over the live graph
 * inside a Neo4j transaction that is always rolled back, so every existing query and filter works
 * and nothing is ever committed.
 */
@Service
public class PastSystemView {

  // ponytail: one past view at a time, and each one rewrites the whole graph in memory. Fine for a
  // few thousand nodes; beyond that, cache the materialized day or query the snapshot directly.
  private final ReentrantLock lock = new ReentrantLock();

  private final SystemStateCaptureService captureService;
  private final SystemGraphState graphState;
  private final PlatformTransactionManager neo4jTransactionManager;
  private final Clock clock;

  public PastSystemView(
      SystemStateCaptureService captureService,
      SystemGraphState graphState,
      @Qualifier("neo4jTransactionManager") PlatformTransactionManager neo4jTransactionManager,
      Clock clock) {
    this.captureService = captureService;
    this.graphState = graphState;
    this.neo4jTransactionManager = neo4jTransactionManager;
    this.clock = clock;
  }

  public <T> T read(LocalDate day, Supplier<T> reader) {
    try (Session ignored = open(day)) {
      return reader.get();
    }
  }

  /** The graph looks like {@code day} until the session is closed. */
  public Session open(LocalDate day) {
    SystemState state = stateOn(day);
    lock.lock();
    TransactionStatus transaction =
        neo4jTransactionManager.getTransaction(new DefaultTransactionDefinition());
    Session session =
        () -> {
          try {
            neo4jTransactionManager.rollback(transaction);
          } finally {
            lock.unlock();
          }
        };
    try {
      graphState.overwriteWith(state);
      return session;
    } catch (RuntimeException e) {
      session.close();
      throw e;
    }
  }

  private SystemState stateOn(LocalDate day) {
    if (day.isAfter(LocalDate.now(clock))) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Date is in the future: " + day);
    }
    return captureService
        .stateOn(day)
        .orElseThrow(
            () ->
                new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "History starts on "
                        + captureService.firstDay().map(LocalDate::toString).orElse("today")));
  }

  public interface Session extends AutoCloseable {
    @Override
    void close();
  }
}
