from django.urls import path

from .views import ItemBrowseByCategoryView


app_name = "jiraibrary_server"

urlpatterns = [
    path("", ItemBrowseByCategoryView.as_view(), name="item_list"),
]