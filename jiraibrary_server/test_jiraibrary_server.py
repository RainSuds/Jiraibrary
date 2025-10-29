from __future__ import annotations

# pyright: reportAttributeAccessIssue=false

from decimal import Decimal
from io import StringIO

from django.core.management import call_command
from django.test import TestCase
from django.urls import reverse

from .forms import ItemForm, ItemPriceForm
from .models import Item, ItemPrice, ItemStatus
from .serializers import serialize_item


class SeedDataIntegrityTests(TestCase):
	fixtures = [
		"jiraibrary_server/fixtures/seed_reference.json",
		"jiraibrary_server/fixtures/seed_catalog.json",
	]

	def setUp(self) -> None:
		self.item = (
			Item.objects.select_related("brand", "category", "metadata")
			.prefetch_related(
				"translations",
				"prices",
				"variants",
				"item_colors__color",
				"item_tags__tag",
				"item_features__feature",
			)
			.get(slug="heart-apron-jsk-setup")
		)

	def test_seed_item_relationships_resolve(self) -> None:
		self.assertEqual(getattr(self.item.brand, "slug", None), "liz-lisa")
		self.assertEqual(getattr(self.item.category, "name", None), "Set-up")
		self.assertEqual(self.item.translations.count(), 2)
		self.assertEqual(self.item.prices.count(), 2)
		self.assertEqual(self.item.variants.count(), 3)
		self.assertIsNotNone(self.item.metadata)
		primary_color = self.item.item_colors.get(is_primary=True)
		self.assertEqual(primary_color.color.name, "Smoky Gray")
		feature = self.item.item_features.get()
		self.assertIn("Sleeve frills", feature.notes)

	def test_soft_delete_and_restore(self) -> None:
		item_id = self.item.pk
		self.item.delete()

		self.assertFalse(Item.objects.filter(pk=item_id).exists())
		self.assertTrue(Item.all_objects.filter(pk=item_id).exists())

		restored = Item.all_objects.get(pk=item_id)
		restored.restore()

		self.assertTrue(Item.objects.filter(pk=item_id).exists())
		self.assertIsNone(Item.objects.get(pk=item_id).deleted_at)

	def test_item_form_validation_rules(self) -> None:
		form_data = {
			"slug": self.item.slug,
			"brand": str(self.item.brand_id),
			"category": str(self.item.category_id),
			"origin_country": self.item.origin_country,
			"default_language": self.item.default_language_id,
			"default_currency": self.item.default_currency_id,
			"release_year": self.item.release_year,
			"release_date": self.item.release_date.isoformat()
			if self.item.release_date
			else "",
			"collaboration": self.item.collaboration,
			"has_matching_set": "on" if self.item.has_matching_set else "",
			"verified_source": "on" if self.item.verified_source else "",
			"status": ItemStatus.DRAFT,
			"approved_at": self.item.approved_at.replace(tzinfo=None).isoformat()
			if self.item.approved_at
			else "",
			"extra_metadata": self.item.extra_metadata,
		}

		form = ItemForm(data=form_data, instance=self.item)
		self.assertFalse(form.is_valid())
		self.assertIn("approved_at", form.errors)

		form_data["status"] = ItemStatus.PUBLISHED
		form = ItemForm(data=form_data, instance=self.item)
		self.assertTrue(form.is_valid())

	def test_price_form_requires_positive_amount(self) -> None:
		price = ItemPrice.objects.filter(item=self.item, currency="JPY").first()
		self.assertIsNotNone(price)

		invalid_data = {
			"item": str(self.item.pk),
			"currency": "JPY",
			"amount": "-1",
			"source": price.source if price else "origin",
			"rate_used": "",
			"valid_from": "",
			"valid_to": "",
		}
		form = ItemPriceForm(data=invalid_data, instance=price)
		self.assertFalse(form.is_valid())
		self.assertIn("amount", form.errors)

		valid_data = {**invalid_data, "amount": str(Decimal("13800"))}
		form = ItemPriceForm(data=valid_data, instance=price)
		self.assertTrue(form.is_valid())

	def test_serializer_payload_structure(self) -> None:
		payload = serialize_item(self.item)
		self.assertEqual(payload["slug"], "heart-apron-jsk-setup")
		self.assertEqual(payload["brand"]["slug"], "liz-lisa")
		self.assertEqual(len(payload["translations"]), 2)
		self.assertEqual(len(payload["prices"]), 2)
		self.assertGreaterEqual(len(payload["variants"]), 1)
		self.assertEqual(payload["colors"][0]["name"], "Smoky Gray")

	def test_seed_integrity_command(self) -> None:
		stdout = StringIO()
		call_command("check_seed_integrity", stdout=stdout)
		self.assertIn("Seed data integrity check passed.", stdout.getvalue())

	def test_browse_page_lists_published_items(self) -> None:
		response = self.client.get(reverse("jiraibrary_server:item_list"))
		self.assertEqual(response.status_code, 200)
		self.assertIn("category_sections", response.context)
		self.assertGreaterEqual(len(response.context["category_sections"]), 1)
		self.assertContains(response, "Heart Apron Jumper-skirt Set-up")

	def test_browse_page_category_filter(self) -> None:
		url = reverse("jiraibrary_server:item_list")
		response = self.client.get(url, {"category": str(self.item.category_id)})
		self.assertEqual(response.status_code, 200)
		sections = response.context["category_sections"]
		self.assertEqual(len(sections), 1)
		section = sections[0]
		self.assertEqual(section.category.category_id, self.item.category_id)
		self.assertTrue(all(entry.category_id == self.item.category_id for entry in section.items))
