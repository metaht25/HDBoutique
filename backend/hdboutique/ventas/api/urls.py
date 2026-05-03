from rest_framework.routers import DefaultRouter
from ventas.api.views import (
    VentaViewSet,
    DetalleventaViewSet,
)

router = DefaultRouter()

router.register('ventas', VentaViewSet, basename='ventas')
router.register('detalles-ventas', DetalleventaViewSet, basename='detalles-ventas')

urlpatterns = router.urls