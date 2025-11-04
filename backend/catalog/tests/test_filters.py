from __future__ import annotations

from decimal import Decimal

from django.http import QueryDict
from django.test import TestCase
from django.test.utils import override_settings

from catalog import filters, models


class ItemFilterTests(TestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.language = models.Language.objects.create(code="en", name="English")
        cls.currency = models.Currency.objects.create(code="USD", name="US Dollar", symbol="$")
        cls.brand = models.Brand.objects.create(slug="brand-one", names={"en": "Brand One"})

        cls.item_1998 = models.Item.objects.create(
            slug="item-1998",
            brand=cls.brand,
            release_year=1998,
            default_language=cls.language,
            default_currency=cls.currency,
            status=models.Item.ItemStatus.PUBLISHED,
        )
        cls.item_2005 = models.Item.objects.create(
            slug="item-2005",
            brand=cls.brand,
            release_year=2005,
            default_language=cls.language,
            default_currency=cls.currency,
            status=models.Item.ItemStatus.PUBLISHED,
        )
        cls.item_2015 = models.Item.objects.create(
            slug="item-2015",
            brand=cls.brand,
            release_year=2015,
            default_language=cls.language,
            default_currency=cls.currency,
            status=models.Item.ItemStatus.PUBLISHED,
        )

        models.ItemPrice.objects.create(
            item=cls.item_2005,
            currency=cls.currency,
            amount=Decimal("150.00"),
        )
        models.ItemPrice.objects.create(
            item=cls.item_2015,
            currency=cls.currency,
            amount=Decimal("450.00"),
        )

    def _make_querydict(self, **params: list[str]) -> QueryDict:
        data = QueryDict("", mutable=True)
        for key, value in params.items():
            data.setlist(key, value)
        return data

    def test_release_year_range_filters_items(self) -> None:
        data = self._make_querydict(release_year_range=["1995:2000", "2010:2016"])
        queryset = filters.ItemFilter(data=data, queryset=models.Item.objects.all()).qs
        slugs = set(queryset.values_list("slug", flat=True))

        self.assertEqual(slugs, {"item-1998", "item-2015"})

    @override_settings(PREFERRED_CURRENCY_CODE="USD")
    def test_price_range_uses_preferred_currency_when_missing(self) -> None:
        data = self._make_querydict(price_range=[":100:200"])
        queryset = filters.ItemFilter(data=data, queryset=models.Item.objects.all()).qs
        slugs = set(queryset.values_list("slug", flat=True))

        self.assertEqual(slugs, {"item-2005"})

    def test_price_range_respects_explicit_currency(self) -> None:
        data = self._make_querydict(price_range=["USD:400:500"])
        queryset = filters.ItemFilter(data=data, queryset=models.Item.objects.all()).qs
        slugs = set(queryset.values_list("slug", flat=True))

        self.assertEqual(slugs, {"item-2015"})
