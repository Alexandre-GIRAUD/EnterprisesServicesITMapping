# IT mapping

The map of applications and the flows between them, as each user saves and organises it.

## Language

**Workspace**:
The world one customer works in: its applications and flows, Data Model, data sources, breach rules, history, views and users. Every user belongs to exactly one workspace and never sees another. Data from before workspaces belongs to the Default workspace.
_Avoid_: tenant, organisation, environment, account

**Pending account**:
A self-registered user whose email is not confirmed yet. It cannot sign in. Confirming the emailed link activates it; left unconfirmed for a week, it is removed, and so is the workspace it created when nobody else belongs to it.
_Avoid_: inactive user, disabled account

**Invitation**:
An admin's emailed offer to join their workspace with a given role. The invitee opens the link within seven days, chooses a password and becomes a member; until then the admin can resend or cancel it.
_Avoid_: invite (for a shared view or sandbox), sign-up link

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
The GitHub login a workspace works with, set by one of its admins by pasting a token in Settings. Listing, cloning and reading repositories in that workspace use its token; there is no personal or server-wide token. A Bitbucket connection works the same way.
_Avoid_: personal token, server token

**Workspace webhook**:
The URL and secret GitHub delivers a workspace's pushes to. Each workspace has its own; admins see and regenerate the secret in Settings.
_Avoid_: global webhook

**Anchor point**:
The exact point on a node side where one arrow endpoint attaches. At most one arrow may use a given anchor point. Several arrows may still attach to the same node side, each on its own anchor point along that side.
_Avoid_: shared junction, merged endpoint, shared tip

**Node side**:
One of the four borders of a box (top, right, bottom, left) that arrows may touch.
_Avoid_: edge of the node (ambiguous with graph edge/flow)

**Breach rule**:
A named rule, shared by every user of a workspace and edited by its admins, whose subject is applications or flows. An element of that subject for which the rule's conditions hold is **in breach**.
_Avoid_: alert, violation, policy

**Not evaluable**:
An element a breach rule cannot decide on, because a value it reads is missing or is not a number. It is listed apart and never counted as in breach. The code calls it `unknown`.
_Avoid_: failed, error
