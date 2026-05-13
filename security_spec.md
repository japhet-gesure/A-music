# Security Specification: A Music

## Data Invariants
- A track must have an artist and title.
- Only admins or the uploader can delete/edit track metadata for non-global tracks.
- Direct PII (email) is only readable by the owner.
- Collaborative playlists allow members to add/remove songs.
- Likes must be associated with a valid song.

## The Dirty Dozen Payloads

1. **Identity Spoofing**: Attempt to create a playlist with someone else's `ownerId`.
2. **Privilege Escalation**: Attempt to set `role: "admin"` on own user profile.
3. **Orphaned Writes**: Create a like for a non-existent song ID.
4. **Denial of Wallet**: Inject a 2MB string into a playlist `name`.
5. **PII Leak**: Authenticated user trying to read another user's PII.
6. **Shadow Update**: Update a song metadata adding `isVerified: true`.
7. **Action Shortcut**: Change a playlist's song list without having permissions.
8. **Invalid ID**: Use `../invalid/path` as a song ID.
9. **Relational Bypass**: Adding a song to a private playlist not owned by the user.
10. **State Corruption**: Changing `createdAt` on an existing document.
11. **Type Poisoning**: Sending an array instead of a string for a song title.
12. **Unauthorized Deletion**: A user trying to delete a global song.

## Final Review assertions
- [ ] isValidUser(incoming()) check on registration.
- [ ] affectedKeys().hasOnly() on all updates.
- [ ] isAdmin() check for global content management.
- [ ] isValidId() check on all document IDs.
- [ ] createdAt immutable.
