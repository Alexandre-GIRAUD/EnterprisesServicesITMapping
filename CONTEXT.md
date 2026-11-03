# IT mapping

The map of applications and the flows between them, as each user saves and organises it.

## Language

**Saved view**:
A named set of filters and layout that belongs to one user. A shared view is a one-time copy of that preset; the recipient owns the copy.
_Avoid_: Snapshot, pin, invite

**Shared sandbox**:
A saved sandbox copied once to another user. The document is the one saved at send time. The recipient owns the copy in their sandbox list.
_Avoid_: live link, invite

**View folder**:
A named container, owned by one user, that holds saved views and other view folders.
_Avoid_: Group, collection, directory

**GitHub connection**:
A GitHub login linked to one Flowra user. Listing, cloning, and reading that user's repositories use their token. The server token remains the fallback when nobody is connected, including push webhooks.
_Avoid_: shared personal token, pasting a token in the browser

**Anchor point**:
The exact point on a node side where one arrow endpoint attaches. At most one arrow may use a given anchor point. Several arrows may still attach to the same node side, each on its own anchor point along that side.
_Avoid_: shared junction, merged endpoint, shared tip

**Node side**:
One of the four borders of a box (top, right, bottom, left) that arrows may touch.
_Avoid_: edge of the node (ambiguous with graph edge/flow)
