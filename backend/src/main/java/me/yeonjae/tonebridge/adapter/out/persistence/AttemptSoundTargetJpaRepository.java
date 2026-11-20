package me.yeonjae.tonebridge.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface AttemptSoundTargetJpaRepository extends JpaRepository<AttemptSoundTargetEntity, AttemptSoundTargetEntity.Key> {

    List<AttemptSoundTargetEntity> findByAttemptIdInOrderByAttemptIdAscPositionAsc(Collection<UUID> attemptIds);

    // clearAutomatically: findById loaded this attempt's targets as managed entities in the same
    // transaction; without clearing, re-inserting one of those ids would collide with the stale copy.
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("DELETE FROM AttemptSoundTargetEntity t WHERE t.attemptId = :attemptId")
    void deleteByAttemptId(UUID attemptId);
}
