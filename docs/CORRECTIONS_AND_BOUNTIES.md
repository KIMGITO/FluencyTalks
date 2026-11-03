# Corrections and bounties: how they work

The summary of each feature is in [Features](FEATURES.md#9-inline-corrections).

There are two correction systems. They serve different things and are deliberately not merged.

| | Library contributions | Chat messages |
|---|---|---|
| Table | `post_discussion` (+ `post_discussion_events` audit log) | `message_corrections` |
| Who corrects | Native speakers or learners **verified** at B1+ in the post's language (`can_correct_language`) | Same rule |
| Discussion | Threaded replies, challenges, clarifications (depth ≤ 12) | Reply to the message in the chat |
| Decided by | Post owner; moderators once escalated | Message sender |
| Accountability | `decision_items` with deadlines, reminders, escalation (`accountability_policy`) | Bounty answers get a reminder before the bounty expires |

## Audit (2026-11-02)

### Library contributions: already consistent
`20261103100900_corrections.sql` and `20261103100800_community_posts.sql` implement the full workflow: posting never implies
correctness; corrections link to the post and its author; threaded discussion; immutable history;
states `pending → accepted | declined | superseded | withdrawn` with `decided_by`, `decided_at` and
a note; owner notifications; deadline, reminders and escalation from a configurable policy; with
extensions, exemptions and appeals. Being online or opening the thread never closes a decision.
No changes were needed here.

### Chat corrections and bounties: problems found

1. **The chat partner was shown a stranger's bounty answer as "Your suggestion".** `CorrectionCard`
   assumed every correction came from the person you chat with. Bounty answers come from people outside
   the chat.
2. **Bounty answers were credited to the wrong name.** For the same reason, the asker saw
   "<chat partner> suggests" for an answer written by someone else.
3. **Helpers could not see their own answer afterwards.** The `read corrections` policy only let chat
   members read corrections. A helper is not a member, so once they answered, the bounty
   left **I can answer** and appeared nowhere else, with no status.
4. **Declining recorded nothing.** `respond_correction` set `dismissed` with no reason, no `decided_by`
   and no `decided_at`, and never told the helper.
5. **Other answers stayed "pending" forever** after the asker accepted one answer and paid the bounty.
6. **The queue capped at 20 with no paging,** ordered by soonest expiry, so on a busy queue a new
   bounty was the *last* row and was cut off. With 48-hour bounties this is reached quickly. This is the
   most likely reason a newly created conversation bounty "does not appear" for an eligible user.
7. **The queue never refreshed** after loading, so a bounty created while the page was open (or
   answered or paid elsewhere) didn't show until you navigated away and back.
8. **A bounty answer accepted notification linked to the asker's chat,** which the helper cannot open.
9. **Nothing stopped invalid transitions** at the data level, e.g. `paid → open`.

Eligibility itself was checked end to end and is correct. The asker's chat partner sees the bounty when
they are a native speaker of the message's language, or verified at B1+. Self-reported levels do not
count; that is the earned-levels rule (`20261103101100_points_and_levels`) and is kept. A message is tagged with the
language chosen in the composer (default: the language you are learning), and only people qualified
in *that* language see the bounty. The new composer shows the tag as a tab, so it is visible.

## State machines (enforced by triggers)

### Bounty (`messages.bounty_status`)
```
none ──(send with bounty, −50 held)──▶ open
open ──(asker accepts an answer)──▶ paid       reward → that answer's author
open ──(48 h pass, or message deleted)──▶ refunded   50 back to the asker
paid, refunded: final
```
There is no *claimed* state. Bounties are an open call: every qualified person may send one answer
(enforced: `already_answered`), and the asker picks one. "Under review" is shown when an open bounty has
pending answers. Roles: **creator** = message sender (pays, reviews, decides); **contributor** =
anyone who answers; **reward recipient** = the author of the accepted answer (`bounty_paid_to`).

### Chat correction / bounty answer (`message_corrections.status`)
```
pending ──accept──▶ accepted
pending ──decline (reason required)──▶ dismissed      helper is notified with the reason
pending ──another answer to the same bounty accepted──▶ superseded
accepted, dismissed, superseded: final (only the helpful/not-helpful rating can still change)
```
Every move from `pending` records `decided_by` and `decided_at`.

### Reminders
When an open bounty has answers waiting and less than 12 hours left, the asker gets one
`bounty_reminder`. Nobody is restricted for not answering a bounty; it just refunds.
If it expires with answers still pending, the asker can still accept one as an ordinary correction (+5).
