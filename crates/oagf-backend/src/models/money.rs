//! Money type backed by `rust_decimal::Decimal` with sqlx PostgreSQL support.
//!
//! PostgreSQL stores money values as NUMERIC(15,2) naira for exact arithmetic.
//! The JSON representation stays a number so the frontend formatters work unchanged.

use std::ops::{Add, Deref, DerefMut, Mul, Sub};
use std::str::FromStr;

use rust_decimal::Decimal;
use serde::{Deserialize, Deserializer, Serialize, Serializer};

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Default, sqlx::Type)]
#[sqlx(transparent)]
pub struct Money(pub Decimal);

impl Money {
    pub fn zero() -> Self {
        Self(Decimal::ZERO)
    }

    pub fn new(value: Decimal) -> Self {
        Self(value)
    }
}

impl Deref for Money {
    type Target = Decimal;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for Money {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl From<Decimal> for Money {
    fn from(value: Decimal) -> Self {
        Self(value)
    }
}

impl From<Money> for Decimal {
    fn from(value: Money) -> Self {
        value.0
    }
}

impl Add for Money {
    type Output = Self;

    fn add(self, rhs: Self) -> Self::Output {
        Self(self.0 + rhs.0)
    }
}

impl Sub for Money {
    type Output = Self;

    fn sub(self, rhs: Self) -> Self::Output {
        Self(self.0 - rhs.0)
    }
}

impl Mul<Decimal> for Money {
    type Output = Self;

    fn mul(self, rhs: Decimal) -> Self::Output {
        Self(self.0 * rhs)
    }
}

impl Serialize for Money {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        // Serialise as a JSON number so the frontend formatters work unchanged.
        // rust_decimal is configured with serde-float, so this emits a number.
        serde::Serialize::serialize(&self.0, serializer)
    }
}

impl<'de> Deserialize<'de> for Money {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        // Accept either a JSON number or a string representation.
        let value = serde_json::Value::deserialize(deserializer)?;
        let decimal = match value {
            serde_json::Value::Number(n) => Decimal::from_str(&n.to_string())
                .map_err(|e| serde::de::Error::custom(format!("Invalid money value: {e}")))?,
            serde_json::Value::String(s) => Decimal::from_str(&s)
                .map_err(|e| serde::de::Error::custom(format!("Invalid money value: {e}")))?,
            _ => return Err(serde::de::Error::custom("Money must be a number or string")),
        };
        Ok(Self(decimal))
    }
}
