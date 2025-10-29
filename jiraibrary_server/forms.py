from django import forms

from .models import Item, ItemMetadata, ItemPrice, ItemStatus, ItemTranslation, ItemVariant


class ItemForm(forms.ModelForm):
    """Model form for curating catalog items."""

    class Meta:
        model = Item
        fields = [
            "slug",
            "brand",
            "category",
            "origin_country",
            "default_language",
            "default_currency",
            "release_year",
            "release_date",
            "collaboration",
            "limited_edition",
            "has_matching_set",
            "verified_source",
            "status",
            "approved_at",
            "extra_metadata",
        ]
        widgets = {
            "release_date": forms.DateInput(attrs={"type": "date"}),
            "approved_at": forms.DateTimeInput(attrs={"type": "datetime-local"}),
        }

    def clean(self):
        cleaned_data = super().clean()
        status = cleaned_data.get("status")
        approved_at = cleaned_data.get("approved_at")

        if status != ItemStatus.PUBLISHED and approved_at:
            self.add_error(
                "approved_at",
                "Only published items can include an approval timestamp.",
            )

        return cleaned_data


class ItemTranslationForm(forms.ModelForm):
    """Form for maintaining item translation records."""

    class Meta:
        model = ItemTranslation
        fields = [
            "item",
            "language",
            "dialect",
            "name",
            "description",
            "pattern",
            "fit",
            "length",
            "occasion",
            "season",
            "lining",
            "closure_type",
            "care_instructions",
            "source",
            "quality",
            "auto_translated",
        ]


class ItemPriceForm(forms.ModelForm):
    """Ensure prices are positive and currency-aligned."""

    class Meta:
        model = ItemPrice
        fields = [
            "item",
            "currency",
            "amount",
            "source",
            "rate_used",
            "valid_from",
            "valid_to",
        ]
        widgets = {
            "valid_from": forms.DateInput(attrs={"type": "date"}),
            "valid_to": forms.DateInput(attrs={"type": "date"}),
        }

    def clean_amount(self):
        amount = self.cleaned_data["amount"]
        if amount <= 0:
            raise forms.ValidationError("Price must be greater than zero.")
        return amount


class ItemVariantForm(forms.ModelForm):
    """Form for variant level details with optional notes."""

    class Meta:
        model = ItemVariant
        fields = [
            "item",
            "variant_label",
            "sku",
            "color",
            "size_descriptor",
            "stock_status",
            "notes",
        ]


class ItemMetadataForm(forms.ModelForm):
    """Lightweight form for metadata adjustments."""

    class Meta:
        model = ItemMetadata
        fields = [
            "item",
            "pattern",
            "sleeve_type",
            "occasion",
            "season",
            "fit",
            "length",
            "lining",
            "closure_type",
            "care_instructions",
            "inspiration",
            "ai_confidence",
        ]
