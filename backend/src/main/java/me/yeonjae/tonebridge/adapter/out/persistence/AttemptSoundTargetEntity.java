package me.yeonjae.tonebridge.adapter.out.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.domain.Persistable;

import java.io.Serializable;
import java.time.Instant;
import java.util.UUID;

/** One sound a feedback giver pointed at on a practice attempt (V35). */
@Entity
@Table(name = "attempt_sound_targets")
@IdClass(AttemptSoundTargetEntity.Key.class)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class AttemptSoundTargetEntity implements Persistable<AttemptSoundTargetEntity.Key> {

    @Id
    @Column(name = "attempt_id", nullable = false)
    private UUID attemptId;

    @Id
    @Column(name = "guide_id", nullable = false, length = 40)
    private String guideId;

    @Column(nullable = false)
    private Integer position;

    @Column(name = "created_by")
    private UUID createdBy;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Override
    public Key getId() {
        return new Key(attemptId, guideId);
    }

    /** Rows are only ever inserted after the attempt's rows are deleted, so skip merge's lookup SELECT. */
    @Override
    public boolean isNew() {
        return true;
    }

    public record Key(UUID attemptId, String guideId) implements Serializable {
        public Key() {
            this(null, null);
        }
    }
}
