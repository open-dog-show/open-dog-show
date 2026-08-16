# Context-specific identity ports for the IAM ACL

Each downstream context (Show Organisation, Entries & Registration, Judging & Results, Platform Administration) defines its own narrow identity port in its domain layer — e.g. `AuthenticatedShowSecretary` — rather than receiving a shared `User`-with-roles object from Identity & Access. The IAM ACL adapter for each context is responsible for translating a `User` and their `Role Grant`s into that context-specific type; if the translation fails (wrong role, suspended account) the adapter rejects the request before the domain layer is reached.

The alternative — a generic `User` carrying a roles list, checked inline by every domain operation — would leak IAM vocabulary into domain layers and scatter authorization logic across contexts. Context-specific ports keep each domain layer's authorization surface explicit and narrow: a domain operation either receives the right identity type or does not compile.
