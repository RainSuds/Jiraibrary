from django.db import models

class Brand(models.Model):
    name = models.CharField(max_length=200, unique=True)
    country = models.CharField(max_length=100, blank=True, null=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.name

class Tag(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name

class Item(models.Model):
    CATEGORY_CHOICES = [
        ('dress','Dress'),
        ('top','Top'),
        ('bottom','Bottom'),
        ('shoes','Shoes'),
        ('accessory','Accessory'),
    ]
    STATUS_CHOICES = [('draft','Draft'), ('approved','Approved')]

    name = models.CharField(max_length=300)
    brand = models.ForeignKey(Brand, on_delete=models.SET_NULL, null=True, blank=True)
    year = models.PositiveIntegerField(null=True, blank=True)
    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    description = models.TextField(blank=True)
    tags = models.ManyToManyField(Tag, blank=True)
    image = models.ImageField(upload_to='items/%Y/%m/%d/', blank=True, null=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='draft')
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name