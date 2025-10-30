# Contributing to minicontratos-mini

First off, thank you for considering contributing to minicontratos-mini! It's people like you that make this project such a great tool.

## Code of Conduct

This project and everyone participating in it is expected to uphold professional and respectful behavior. By participating, you are expected to:

- Use welcoming and inclusive language
- Be respectful of differing viewpoints and experiences
- Gracefully accept constructive criticism
- Focus on what is best for the community
- Show empathy towards other community members

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. When creating a bug report, include:

**Bug Report Template:**
```
**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
 - OS: [e.g. macOS, Windows, Linux]
 - Browser [e.g. chrome, safari]
 - Node version: [e.g. 22.0.0]
 - Version [e.g. 3.1.0]

**Additional context**
Add any other context about the problem here.
```

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, include:

**Enhancement Template:**
```
**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is.

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.
```

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`pnpm test`)
5. Run linter (`pnpm lint`)
6. Commit your changes (see commit message guidelines below)
7. Push to your branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

**Pull Request Guidelines:**
- Fill in the PR template
- Link any related issues
- Include relevant test coverage
- Update documentation as needed
- Follow the code style guidelines
- Ensure all CI checks pass
- Keep changes focused and atomic

## Development Setup

### Prerequisites

- Node.js 22.x
- pnpm 9.x
- PostgreSQL database (Neon, Vercel Postgres, or local)
- (Optional) Redis for caching

### Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/danvoulez/mini-maxi.git
   cd mini-maxi
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

4. **Run database migrations**
   ```bash
   pnpm db:migrate
   ```

5. **Start development server**
   ```bash
   pnpm dev
   ```

6. **Access the application**
   Open [http://localhost:3000](http://localhost:3000)

### Development Commands

```bash
# Development
pnpm dev              # Start dev server with Turbo
pnpm build            # Build for production
pnpm start            # Start production server

# Code Quality
pnpm lint             # Run linter
pnpm format           # Auto-fix formatting issues

# Database
pnpm db:migrate       # Run migrations
pnpm db:generate      # Generate migration from schema changes
pnpm db:studio        # Open Drizzle Studio
pnpm db:push          # Push schema changes (dev only)

# Testing
pnpm test             # Run Playwright tests
```

## Code Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Enable strict mode compliance
- Prefer interfaces over types for object shapes
- Use proper typing - avoid `any` when possible
- Document complex types with JSDoc comments

### React/Next.js

- Use functional components with hooks
- Follow React hooks rules
- Prefer server components by default
- Use `"use client"` directive only when needed
- Keep components small and focused

### Naming Conventions

- **Files**: kebab-case (e.g., `user-profile.tsx`)
- **Components**: PascalCase (e.g., `UserProfile`)
- **Functions**: camelCase (e.g., `getUserProfile`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `MAX_RETRIES`)
- **Types/Interfaces**: PascalCase (e.g., `UserProfile`)

### Code Organization

```
app/                  # Next.js app router
  (auth)/            # Auth route group
  (chat)/            # Chat route group
components/          # React components
lib/                 # Core business logic
  ai/               # AI-related utilities
  db/               # Database layer
  memory/           # CEREBRO memory system
tests/              # Test files
  e2e/              # End-to-end tests
  lib/              # Unit tests
  routes/           # API route tests
```

### Comments

- Write self-documenting code first
- Add comments for complex business logic
- Use JSDoc for functions and types
- Explain "why" not "what" in comments

Example:
```typescript
/**
 * Promotes a temporary memory to permanent storage.
 * This is irreversible and should only be done for validated data.
 * 
 * @param key - Unique memory identifier
 * @param actorRole - Role of the actor performing promotion
 * @returns Promise resolving to the promoted memory
 */
async function promoteMemory(key: string, actorRole: Role): Promise<Memory> {
  // Implementation
}
```

## Commit Message Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `ci`: CI/CD changes

**Examples:**
```
feat(cerebro): add auto-promotion for frequently accessed memories

fix(auth): resolve session timeout on idle users

docs(readme): update installation instructions

test(memory): add unit tests for encryption module
```

## Testing Guidelines

### Unit Tests

- Test files: `*.test.ts` or `*.test.tsx`
- Location: `tests/lib/` for library code
- Coverage: Aim for >80% for critical paths
- Focus: Pure functions, utilities, business logic

### Integration Tests

- Location: `tests/routes/` for API routes
- Test API contracts and error handling
- Mock external dependencies

### E2E Tests

- Location: `tests/e2e/`
- Use Playwright
- Test critical user flows
- Keep tests fast and reliable

### Testing Best Practices

- Write descriptive test names
- Follow AAA pattern (Arrange, Act, Assert)
- One assertion per test when possible
- Mock external services
- Use factories for test data
- Clean up after tests

## Documentation

### Code Documentation

- JSDoc for all exported functions
- README for each major module
- Inline comments for complex logic
- Type definitions with descriptions

### User Documentation

- Update README.md for user-facing changes
- Add examples for new features
- Update CHANGELOG.md
- Create guides for complex features

## Review Process

All submissions require review. We use GitHub pull requests for this purpose.

**Review Checklist:**
- [ ] Code follows style guidelines
- [ ] Tests pass
- [ ] Linter passes
- [ ] Documentation updated
- [ ] No security vulnerabilities introduced
- [ ] Breaking changes are documented
- [ ] Performance implications considered

## Release Process

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create release tag
4. Deploy to production
5. Create GitHub release with notes

## Getting Help

- **Documentation**: Check README.md and module-specific READMEs
- **Discussions**: Use GitHub Discussions for questions
- **Issues**: Search existing issues or create a new one
- **Discord**: [Add Discord link if available]

## Recognition

Contributors will be:
- Listed in the contributors section
- Credited in release notes for significant contributions
- Invited to maintainer role for sustained contributions

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to minicontratos-mini! 🚀
