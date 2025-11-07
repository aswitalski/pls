### Name
Build Opera

### Description
There are four different desktop products provided by Opera Software:
- Opera One: the flagship browser (previously called Opera Desktop)
- Opera GX: the gamers' browser
- Opera Air: the mindfullness browser (also called Opera Zen)
- Opera Neon: AI-focused agentic browser, with build in Operator

The build command can be specified in many ways like:
- "build Opera" or "build desktop" - default to Opera One
- "build GX", "build browser for gamers" - points to Opera GX
- "build Air", "build mindful browser" - points to Opera Air
- "build AI browser", "build operator" - points to Opera Neon

Builds always need to be run from the project's root directory.

The build process typically requires only compilation.
The generation script needs to be run only when major changes are made.

If the user requests compilation only, the project generation step can be skipped.

The steps provided should specify the browser name directly.

### Steps
- Navigate to the {BROWSER} project's root directory
- Execute the {BROWSER} project generation script
- Compile the {BROWSER}'s source code
