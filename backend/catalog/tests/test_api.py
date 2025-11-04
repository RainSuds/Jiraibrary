from __future__ import annotations

from decimal import Decimal
from typing import cast

from django.urls import reverse
from rest_framework.response import Response
from rest_framework.test import APITestCase

from catalog import models


class ItemAPITests(APITestCase):
    @classmethod
    def setUpTestData(cls) -> None:
        cls.language = models.Language.objects.create(code="en", name="English")
        cls.currency = models.Currency.objects.create(code="USD", name="US Dollar", symbol="$")
        cls.brand = models.Brand.objects.create(slug="brand-alpha", names={"en": "Brand Alpha"})
        cls.category = models.Category.objects.create(name="Dresses", slug="dresses")

        for index, year in enumerate((2001, 2005, 2010), start=1):
            item = models.Item.objects.create(
                slug=f"alpha-{index}",
                brand=cls.brand,
                category=cls.category,
                default_language=cls.language,
                default_currency=cls.currency,
                release_year=year,
                status=models.Item.ItemStatus.PUBLISHED,
            )
            models.ItemTranslation.objects.create(
                item=item,
                language=cls.language,
                name=f"Alpha Item {index}",
            )
            if index == 1:
                models.ItemPrice.objects.create(
                    item=item,
                    currency=cls.currency,
                    amount=Decimal("120.00"),
                )

    def test_list_respects_limit_but_reports_full_count(self) -> None:
        url = reverse("item-list")
        response = cast(Response, self.client.get(url, {"limit": 2}))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["result_count"], 3)
        self.assertEqual(len(response.data["results"]), 2)

    def test_selected_filters_echo_back_request_values(self) -> None:
        url = reverse("item-list")
        params = {
            "limit": 1,
            "release_year_range": "2000:2006",
            "price_range": "USD:0:500",
        }
        response = cast(Response, self.client.get(url, params))

        self.assertEqual(response.status_code, 200)
        selected = response.data["selected"]

        self.assertEqual(selected["release_year_ranges"], [{"min": 2000, "max": 2006, "value_key": "2000:2006"}])
        self.assertEqual(
            selected["price_ranges"],
            [{"currency": "USD", "min": 0.0, "max": 500.0, "value_key": "USD:0:500"}],
        )
        self.assertEqual(selected["price_currency"], "USD")
        self.assertEqual(len(response.data["results"]), 1)