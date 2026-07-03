"""Factory-boy definitions for auth test data (SDD §7.3, §7.4).

Factories provide a fast, repeatable way to construct ORM model
instances with sensible defaults.  Custom attributes can be supplied
at construction time via keyword overrides.

References:
    - CODE_STYLE.md §7.2: Factory pattern
    - SDD.md §7.3: Integration-test fixtures
    - SDD.md §7.4: Fixture examples
"""

import uuid

import factory
from factory.fuzzy import FuzzyText

from app.modules.auth.models import User
from app.shared.security import hash_password


class UserFactory(factory.Factory):
    """Generate ``User`` ORM instances for testing.

    The ``password_hash`` field defaults to an Argon2id hash of the string
    ``"SecurePass123"`` so that integration tests can authenticate
    against it without extra setup.

    Usage::

        user = UserFactory()                          # all defaults
        user = UserFactory(email="custom@test.com")   # override email
        user = UserFactory(is_active=False)           # inactive user
    """

    class Meta:
        model = User

    id = factory.LazyFunction(uuid.uuid4)
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    password_hash = factory.LazyFunction(lambda: hash_password("SecurePass123"))
    full_name = factory.Faker("name")
    phone = factory.Faker("phone_number")
    is_active = True