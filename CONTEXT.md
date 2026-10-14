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
