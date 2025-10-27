from django.views.generic import ListView, DetailView
from .models import Item

class ItemListView(ListView):
    model = Item
    paginate_by = 24
    template_name = 'catalog/item_list.html'

    def get_queryset(self):
        qs = super().get_queryset().filter(status='approved')
        q = self.request.GET.get('q')
        if q:
            qs = qs.filter(name__icontains=q)  # extend to brand__name etc
        tags = self.request.GET.getlist('tag')
        if tags:
            qs = qs.filter(tags__name__in=tags).distinct()
        brand = self.request.GET.get('brand')
        if brand:
            qs = qs.filter(brand__name=brand)
        category = self.request.GET.get('category')
        if category:
            qs = qs.filter(category=category)
        return qs

class ItemDetailView(DetailView):
    model = Item
    template_name = 'catalog/item_detail.html'