from rest_framework.routers import DefaultRouter
from compras.api.views import (
    ComprasViewSet,
    DetallecompraViewSet,
)

router = DefaultRouter()

router.register('compras', ComprasViewSet, basename='compras')
router.register('detalles-compras', DetallecompraViewSet, basename='detalles-compras')

urlpatterns = router.urls