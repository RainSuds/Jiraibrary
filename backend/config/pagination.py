"""Pagination utilities for the Jiraibrary API."""
from rest_framework.pagination import PageNumberPagination


class StandardResultsSetPagination(PageNumberPagination):
    """Allow clients to request larger page sizes when needed."""

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 500
